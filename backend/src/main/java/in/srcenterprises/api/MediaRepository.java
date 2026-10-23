package in.srcenterprises.api;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface MediaRepository extends JpaRepository<MediaContent,Long>{
 List<MediaContent> findByPublishedTrueOrderByTitleAsc();
}